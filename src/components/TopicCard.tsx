import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getTagColor } from "@/lib/tagColors";

interface TopicCardProps {
  id: string;
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  createdAt?: string;
}

export const TopicCard = ({ id, title, tags, voteCount, creatorName, isHot, createdAt }: TopicCardProps) => {
  return (
    <Link to={`/vote/${id}`}>
      <Card className="bg-gradient-card shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">
              {title}
            </h3>
            {isHot && (
              <Flame className="w-5 h-5 text-accent ml-2 flex-shrink-0" />
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <Badge 
                key={tag} 
                className={`text-xs font-medium border-0 ${getTagColor(tag)}`}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        </CardContent>
        
        <CardFooter className="px-5 py-3 bg-muted/30 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-primary font-semibold">
              <Flame className="w-4 h-4" />
              <span>{voteCount}</span>
            </div>
            
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{creatorName}</span>
            </div>
          </div>
          
          {createdAt && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{createdAt}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
};
