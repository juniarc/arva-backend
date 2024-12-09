from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Tag(db.Model):
    __tablename__ = "tags"
    tag_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    tag_name = db.Column(db.String(120), unique=True, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active')

    #relasi ke TagProductAssociation
    product_tag = relationship("TagProductAssociation", back_populates="tag", cascade="all, delete", lazy=True)


    def __repr__(self):
        return f'<Tag {self.tag_id} {self.tag_name} {self.status}>'

    def to_dict(self):
        return {
            'tag_id': self.tag_id,
            'tag_name': self.tag_name,
            'tag.status': self.status
        }